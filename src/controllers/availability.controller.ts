import { Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import Availability from '../models/availability.model';
import AppError from '../utils/AppError';

// Helper to convert a local date and time string in a specific timezone to a UTC Date
function getLocalDateTimeInUTC(
  dateStr: string, // "YYYY-MM-DD"
  timeStr: string, // "HH:MM AM/PM"
  timeZone: string
): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Parse timeStr: e.g. "09:00 AM"
  const [timePart, modifier] = timeStr.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  
  // Construct as a UTC date first
  const localUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  
  // Get offset in minutes for this specific date and timezone
  const tzString = localUtc.toLocaleString('en-US', { timeZone, timeZoneName: 'longOffset' });
  // tzString is e.g. "6/5/2026, 9:00:00 AM, GMT+5:30" or "GMT-4" or "GMT"
  const parts = tzString.split('GMT');
  let offsetMinutes = 0;
  if (parts.length > 1) {
    const offsetPart = parts[1].trim(); // "+5:30" or "-4" or ""
    if (offsetPart) {
      const hasColon = offsetPart.includes(':');
      const [hoursStr, minutesStr] = hasColon ? offsetPart.split(':') : [offsetPart, '0'];
      const offsetHours = parseInt(hoursStr, 10);
      const offsetMins = parseInt(minutesStr, 10);
      offsetMinutes = offsetHours * 60 + (offsetHours >= 0 ? offsetMins : -offsetMins);
    }
  }
  
  // Subtract the offset to get the correct UTC date
  return new Date(localUtc.getTime() - offsetMinutes * 60 * 1000);
}

// Helper to parse time string e.g. "09:00 AM" into minutes from midnight
const parseTimeToMinutes = (timeStr: string): number => {
  const [timePart, modifier] = timeStr.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Set availability for a range of dates
export const setAvailability = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const doctorId = req.user._id;
  const { startDate, endDate, timezone, slotDuration, availability } = req.body;

  if (req.user.role !== 'doctor') {
    throw new AppError('Only doctors can set availability', 403);
  }

  // Parse start and end dates
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    throw new AppError('Invalid date range', 400);
  }

  const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 90) {
    throw new AppError('Date range cannot exceed 90 days', 400);
  }

  // Create a mapping of availability by weekday name for quick lookup
  const weekdayConfig = new Map<string, { startTime: string; endTime: string }>();
  for (const item of availability) {
    weekdayConfig.set(item.dayOfWeek, {
      startTime: item.startTime,
      endTime: item.endTime
    });
  }

  // Generate date list between startDate and endDate
  const dateList: string[] = [];
  let current = new Date(start);
  while (current <= end) {
    dateList.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const results = [];

  for (const dateStr of dateList) {
    // Determine the day name in the doctor's timezone (using T12:00:00 to keep it stable)
    const localNoon = new Date(`${dateStr}T12:00:00`);
    const dayOfWeek = localNoon.toLocaleString('en-US', { timeZone: timezone, weekday: 'long' });

    const config = weekdayConfig.get(dayOfWeek);
    if (!config) {
      // If doctor is not available on this day of the week, skip creating/updating slots
      continue;
    }

    // Generate slots for this date
    const startMins = parseTimeToMinutes(config.startTime);
    const endMins = parseTimeToMinutes(config.endTime);

    if (startMins >= endMins) {
      throw new AppError(`Start time must be before end time for ${dayOfWeek}`, 400);
    }

    const slotsGenerated = [];
    for (let mins = startMins; mins < endMins; mins += slotDuration) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;

      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHours = h % 12 === 0 ? 12 : h % 12;
      const displayMins = m.toString().padStart(2, '0');
      const timeStr = `${displayHours.toString().padStart(2, '0')}:${displayMins} ${ampm}`;

      const dateTime = getLocalDateTimeInUTC(dateStr, timeStr, timezone);

      slotsGenerated.push({
        time: timeStr,
        dateTime,
        isBooked: false
      });
    }

    // Check if availability record already exists for this date and doctor
    const existing = await Availability.findOne({ doctorId, date: dateStr });
    let slotsToSave = slotsGenerated;

    if (existing) {
      // Keep track of already booked slots
      const bookedMap = new Map(
        existing.slots.filter(s => s.isBooked).map(s => [s.time, s])
      );

      // Merge: preserve isBooked status if that slot time existed and was booked
      slotsToSave = slotsGenerated.map(slot => {
        const existingSlot = bookedMap.get(slot.time);
        if (existingSlot) {
          return {
            time: slot.time,
            dateTime: slot.dateTime,
            isBooked: true
          };
        }
        return slot;
      });
    }

    const updated = await Availability.findOneAndUpdate(
      { doctorId, date: dateStr },
      {
        doctorId,
        date: dateStr,
        timezone,
        slots: slotsToSave
      },
      { upsert: true, new: true }
    );
    results.push(updated);
  }

  res.status(200).json({
    status: 'success',
    message: `Availability configured successfully for ${results.length} dates.`,
    data: {
      count: results.length
    }
  });
});

// Retrieve availability for a specific doctor (Public/Patient endpoint)
export const getAvailability = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { doctorId } = req.params;
  const { date } = req.query; // optional "YYYY-MM-DD"

  const filter: any = { doctorId };
  if (date) {
    filter.date = date;
  }

  const availability = await Availability.find(filter).sort({ date: 1 });

  res.status(200).json({
    status: 'success',
    data: {
      availability
    }
  });
});

// Retrieve availability for the logged-in doctor
export const getMyAvailability = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const doctorId = req.user._id;
  const { date } = req.query; // optional "YYYY-MM-DD"

  const filter: any = { doctorId };
  if (date) {
    filter.date = date;
  } else {
    // If no date, return all from today onwards
    const todayStr = new Date().toISOString().split('T')[0];
    filter.date = { $gte: todayStr };
  }

  const availability = await Availability.find(filter).sort({ date: 1 });

  res.status(200).json({
    status: 'success',
    data: {
      availability
    }
  });
});

// Retrieve only unbooked slots for a doctor on a specific date in [ { "time": "10:00 AM" } ] format
export const getDoctorSlots = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    throw new AppError('Please provide doctorId and date query parameters', 400);
  }

  const availability = await Availability.findOne({ doctorId, date: date as string });
  if (!availability) {
    return res.status(200).json([]);
  }

  const unbookedSlots = availability.slots
    .filter((slot: any) => !slot.isBooked)
    .map((slot: any) => ({
      time: slot.time
    }));

  return res.status(200).json(unbookedSlots);
});
