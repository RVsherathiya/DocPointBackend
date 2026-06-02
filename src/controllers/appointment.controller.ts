import { Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import Appointment from '../models/appointment.model';
import Doctor from '../models/doctor.model';
import Availability from '../models/availability.model';
import AppError from '../utils/AppError';

export const getAppointments = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const patientId = req.user._id;
  const { search, status, type } = req.query;
  const profileId = req.header('x-profile-id') || 'self';

  // Build the base query based on profile
  const baseQuery: any = { patient: patientId };
  if (profileId && profileId !== 'self') {
    baseQuery.familyMemberId = profileId;
  } else {
    baseQuery.$or = [
      { familyMemberId: { $exists: false } },
      { familyMemberId: null },
      { familyMemberId: 'self' }
    ];
  }

  // Check if patient profile has any appointments. If not, seed mock appointments.
  const count = await Appointment.countDocuments(baseQuery);
  if (count === 0) {
    // Find active doctors in the database to link to
    let doctors = await Doctor.find({ status: 'active', verificationStatus: 'approved' });
    if (doctors.length === 0) {
      // Fallback: If no doctors are seeded yet, seed them first
      const mockDocs = [
        {
          name: 'Dr. Raj Patel',
          email: 'raj.patel@docpoint.com',
          phone: '+919999999991',
          isEmailVerified: true,
          role: 'doctor' as const,
          status: 'active' as const,
          verificationStatus: 'approved' as const,
          isProfileCompleted: true,
          doctorProfile: {
            specialization: 'Cardiologist',
            qualification: 'MBBS, MD, FACC',
            experience: 12,
            consultationFee: 500,
            clinicName: 'Apollo Clinic',
            clinicAddress: '123 Apollo Circle, Ahmedabad',
            gender: 'male',
            dob: '1984-05-15',
          },
        },
        {
          name: 'Dr. Sneha Sharma',
          email: 'sneha.sharma@docpoint.com',
          phone: '+919999999992',
          isEmailVerified: true,
          role: 'doctor' as const,
          status: 'active' as const,
          verificationStatus: 'approved' as const,
          isProfileCompleted: true,
          doctorProfile: {
            specialization: 'Pediatrician',
            qualification: 'MBBS, DCH, MD',
            experience: 8,
            consultationFee: 400,
            clinicName: 'Kids Care Clinic',
            clinicAddress: '456 Kinder Rd, Ahmedabad',
            gender: 'female',
            dob: '1990-08-22',
          },
        },
        {
          name: 'Dr. Rohan Gupta',
          email: 'rohan.gupta@docpoint.com',
          phone: '+919999999993',
          isEmailVerified: true,
          role: 'doctor' as const,
          status: 'active' as const,
          verificationStatus: 'approved' as const,
          isProfileCompleted: true,
          doctorProfile: {
            specialization: 'Dermatologist',
            qualification: 'MBBS, DVD, MD',
            experience: 10,
            consultationFee: 450,
            clinicName: 'Skin Care Clinic',
            clinicAddress: '789 Derma Way, Ahmedabad',
            gender: 'male',
            dob: '1988-12-05',
          },
        },
      ];
      for (const d of mockDocs) {
        await Doctor.create(d);
      }
      doctors = await Doctor.find({ status: 'active', verificationStatus: 'approved' });
    }

    const doc1 = doctors[0];
    const doc2 = doctors[1] || doctors[0];
    const doc3 = doctors[2] || doctors[0];

    const currentProfileId = profileId === 'self' ? undefined : profileId;

    // Seed mock appointments
    const mockAppointments = [
      {
        patient: patientId,
        familyMemberId: currentProfileId,
        doctor: doc1._id,
        appointmentId: 'AP-1025',
        date: '2026-06-10',
        timeSlot: '11:30 AM',
        consultationType: 'video',
        status: 'confirmed',
        paymentInfo: {
          fee: doc1.doctorProfile?.consultationFee || 500,
          paidAmount: doc1.doctorProfile?.consultationFee || 500,
          paymentMethod: 'card',
          transactionStatus: 'paid',
          transactionId: 'TXN-982319082',
        },
        doctorNotes: 'Maintain low-sodium diet and monitor heart rate daily.',
      },
      {
        patient: patientId,
        familyMemberId: currentProfileId,
        doctor: doc2._id,
        appointmentId: 'AP-2018',
        date: '2026-06-12',
        timeSlot: '04:30 PM',
        consultationType: 'clinic',
        status: 'upcoming',
        paymentInfo: {
          fee: doc2.doctorProfile?.consultationFee || 400,
          paidAmount: doc2.doctorProfile?.consultationFee || 400,
          paymentMethod: 'cash',
          transactionStatus: 'paid',
          transactionId: 'TXN-234901832',
        },
      },
      {
        patient: patientId,
        familyMemberId: currentProfileId,
        doctor: doc3._id,
        appointmentId: 'AP-3092',
        date: '2026-05-28',
        timeSlot: '10:00 AM',
        consultationType: 'chat',
        status: 'completed',
        paymentInfo: {
          fee: doc3.doctorProfile?.consultationFee || 450,
          paidAmount: doc3.doctorProfile?.consultationFee || 450,
          paymentMethod: 'upi',
          transactionStatus: 'paid',
          transactionId: 'TXN-874213904',
        },
        prescription: 'Apply hydrocortisone cream twice daily. Avoid allergen triggers.',
        doctorNotes: 'Follow-up if symptoms persist beyond one week.',
        review: {
          rating: 5,
          comment: 'Very helpful and friendly consultation!',
        },
      },
      {
        patient: patientId,
        familyMemberId: currentProfileId,
        doctor: doc1._id,
        appointmentId: 'AP-0982',
        date: '2026-05-15',
        timeSlot: '02:00 PM',
        consultationType: 'video',
        status: 'cancelled',
        cancellationReason: 'Feeling better',
        paymentInfo: {
          fee: doc1.doctorProfile?.consultationFee || 500,
          paidAmount: doc1.doctorProfile?.consultationFee || 500,
          paymentMethod: 'card',
          transactionStatus: 'refunded',
          transactionId: 'TXN-019827392',
        },
      },
    ];

    for (const appt of mockAppointments) {
      await Appointment.create(appt);
    }
  }

  // Build the query
  const query: any = { ...baseQuery };

  if (status && status !== 'all') {
    if (status === 'upcoming') {
      query.status = { $in: ['upcoming', 'confirmed', 'rescheduled'] };
    } else {
      query.status = status;
    }
  }

  if (type && type !== 'all') {
    query.consultationType = type;
  }

  // Fetch appointments and populate doctor details
  let appointmentsList = await Appointment.find(query)
    .populate({
      path: 'doctor',
      select: 'name doctorProfile',
    })
    .sort({ createdAt: -1 });

  // Filter by search query in memory
  if (search) {
    const searchLower = (search as string).toLowerCase();
    appointmentsList = appointmentsList.filter((appt: any) => {
      const docName = appt.doctor?.name || '';
      const docSpecialty = appt.doctor?.doctorProfile?.specialization || '';
      const apptId = appt.appointmentId || '';
      return (
        docName.toLowerCase().includes(searchLower) ||
        docSpecialty.toLowerCase().includes(searchLower) ||
        apptId.toLowerCase().includes(searchLower)
      );
    });
  }

  // Map backend structure to clean frontend models
  const formattedAppointments = appointmentsList.map((appt: any) => {
    const apptObj = appt.toObject();
    const docObj = apptObj.doctor || {};
    const docProfile = docObj.doctorProfile || {};

    return {
      id: apptObj._id.toString(),
      appointmentId: apptObj.appointmentId,
      date: apptObj.date,
      timeSlot: apptObj.timeSlot,
      consultationType: apptObj.consultationType,
      status: apptObj.status,
      cancellationReason: apptObj.cancellationReason,
      paymentInfo: apptObj.paymentInfo,
      prescription: apptObj.prescription,
      invoiceUrl: apptObj.invoiceUrl,
      doctorNotes: apptObj.doctorNotes,
      review: apptObj.review,
      doctor: {
        id: docObj._id ? docObj._id.toString() : '',
        name: docObj.name || 'Doctor Name',
        specialization: docProfile.specialization || 'General',
        specializationKey: docProfile.specialization
          ? `home.categories.${docProfile.specialization.toLowerCase().replace(/\s+/g, '_')}`
          : 'home.categories.general_physician',
        qualification: docProfile.qualification || 'MBBS',
        experience: docProfile.experience || 5,
        profilePhoto: docProfile.profilePhoto || null,
      },
    };
  });

  // Calculate statistics for all appointments of this patient profile
  const allPatientAppointments = await Appointment.find(baseQuery);
  const stats = {
    upcoming: allPatientAppointments.filter((a) => ['upcoming', 'confirmed', 'rescheduled'].includes(a.status)).length,
    completed: allPatientAppointments.filter((a) => a.status === 'completed').length,
    cancelled: allPatientAppointments.filter((a) => a.status === 'cancelled').length,
    total: allPatientAppointments.length,
  };

  res.status(200).json({
    status: 'success',
    data: {
      appointments: formattedAppointments,
      stats,
    },
  });
});

export const cancelAppointment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  const appointment = await Appointment.findOne({ _id: id, patient: req.user._id });
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.status === 'completed' || appointment.status === 'cancelled') {
    throw new AppError('Cannot cancel a completed or already cancelled appointment', 400);
  }

  appointment.status = 'cancelled';
  appointment.cancellationReason = reason || 'Cancelled by patient';
  appointment.paymentInfo.transactionStatus = 'refunded';
  await appointment.save();

  res.status(200).json({
    status: 'success',
    message: 'Appointment cancelled successfully',
    data: {
      appointment,
    },
  });
});

export const rescheduleAppointment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { date, timeSlot } = req.body;

  if (!date || !timeSlot) {
    throw new AppError('Please provide a date and time slot', 400);
  }

  const appointment = await Appointment.findOne({ _id: id, patient: req.user._id });
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.status === 'completed' || appointment.status === 'cancelled') {
    throw new AppError('Cannot reschedule a completed or cancelled appointment', 400);
  }

  appointment.date = date;
  appointment.timeSlot = timeSlot;
  appointment.status = 'rescheduled';
  await appointment.save();

  res.status(200).json({
    status: 'success',
    message: 'Appointment rescheduled successfully',
    data: {
      appointment,
    },
  });
});

export const addReview = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  if (!rating) {
    throw new AppError('Please provide a rating', 400);
  }

  const appointment = await Appointment.findOne({ _id: id, patient: req.user._id });
  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  if (appointment.status !== 'completed') {
    throw new AppError('Cannot review an incomplete appointment', 400);
  }

  appointment.review = {
    rating: Number(rating),
    comment: comment || '',
  };
  await appointment.save();

  res.status(200).json({
    status: 'success',
    message: 'Review added successfully',
    data: {
      appointment,
    },
  });
});

export const bookAppointment = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
  const patientId = req.user._id;
  const { doctorId, date, timeSlot, consultationType, familyMemberId } = req.body;

  if (!doctorId || !date || !timeSlot || !consultationType) {
    throw new AppError('Please provide doctorId, date, timeSlot, and consultationType', 400);
  }

  // 1. Verify doctor exists
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw new AppError('Doctor not found', 404);
  }

  // 2. Fetch doctor's fee for this consultation type
  let fee = doctor.doctorProfile?.consultationFee || 500;
  if (doctor.doctorProfile?.consultationTypes) {
    const typeKey = consultationType === 'clinic' ? 'clinic' : (consultationType === 'chat' ? 'chat' : 'video');
    const typeConfig = (doctor.doctorProfile.consultationTypes as any)[typeKey];
    if (typeConfig && typeConfig.active) {
      fee = typeConfig.fee;
    }
  }

  // 3. Check availability slot and mark it booked
  const availability = await Availability.findOne({ doctorId, date });
  if (!availability) {
    throw new AppError('Doctor is not available on this date', 400);
  }

  const slotIndex = availability.slots.findIndex((s: any) => s.time === timeSlot);
  if (slotIndex === -1) {
    throw new AppError('Time slot is not available', 400);
  }

  if (availability.slots[slotIndex].isBooked) {
    throw new AppError('Time slot is already booked', 400);
  }

  // Mark slot as booked
  availability.slots[slotIndex].isBooked = true;
  await availability.save();

  // 4. Create appointment
  const appointmentId = `AP-${Math.floor(1000 + Math.random() * 9000)}`;
  const transactionId = `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`;

  const appointment = await Appointment.create({
    patient: patientId,
    familyMemberId: familyMemberId === 'self' || !familyMemberId ? undefined : familyMemberId,
    doctor: doctorId,
    appointmentId,
    date,
    timeSlot,
    consultationType,
    status: 'confirmed',
    paymentInfo: {
      fee,
      paidAmount: fee,
      paymentMethod: 'card',
      transactionStatus: 'paid',
      transactionId,
    },
  });

  res.status(201).json({
    status: 'success',
    message: 'Appointment booked successfully',
    data: {
      appointment,
    },
  });
});
