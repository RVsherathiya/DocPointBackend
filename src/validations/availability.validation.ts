import { z } from 'zod';

export const setAvailabilitySchema = z.object({
  body: z.object({
    startDate: z.string({
      required_error: 'Start date is required',
    })
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    endDate: z.string({
      required_error: 'End date is required',
    })
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
    timezone: z.string({
      required_error: 'Timezone is required',
    })
      .trim()
      .min(1, 'Timezone cannot be empty'),
    slotDuration: z.number({
      required_error: 'Slot duration is required',
    })
      .min(5, 'Slot duration must be at least 5 minutes')
      .max(180, 'Slot duration must be at most 180 minutes'),
    availability: z.array(
      z.object({
        dayOfWeek: z.enum([
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ]),
        startTime: z.string({
          required_error: 'Start time is required',
        })
          .regex(/^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$/, 'Start time must be in HH:MM AM/PM format'),
        endTime: z.string({
          required_error: 'End time is required',
        })
          .regex(/^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$/, 'End time must be in HH:MM AM/PM format'),
      })
    ).min(1, 'At least one day of availability must be configured'),
  }),
});
