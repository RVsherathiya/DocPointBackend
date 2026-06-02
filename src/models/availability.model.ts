import mongoose, { Schema, Document } from 'mongoose';

export interface ISlot {
  time: string; // e.g. "09:00 AM"
  dateTime: Date; // Timezone-aware UTC Date representation of this slot
  isBooked: boolean;
}

export interface IAvailability extends Document {
  doctorId: mongoose.Types.ObjectId;
  date: string; // "YYYY-MM-DD" in local timezone
  timezone: string; // Timezone name, e.g., "Asia/Kolkata" or "America/New_York"
  slots: ISlot[];
  createdAt: Date;
  updatedAt: Date;
}

const slotSchema = new Schema<ISlot>({
  time: { 
    type: String, 
    required: [true, 'Slot time is required'] 
  },
  dateTime: { 
    type: Date, 
    required: [true, 'Slot UTC Date-Time is required'] 
  },
  isBooked: { 
    type: Boolean, 
    default: false 
  },
});

const availabilitySchema = new Schema<IAvailability>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor ID is required'],
    },
    date: {
      type: String,
      required: [true, 'Date (YYYY-MM-DD) is required'],
    },
    timezone: {
      type: String,
      required: [true, 'Timezone is required'],
    },
    slots: [slotSchema],
  },
  {
    timestamps: true,
  }
);

// Ensure a doctor can only have one availability record per date
availabilitySchema.index({ doctorId: 1, date: 1 }, { unique: true });

const Availability = mongoose.model<IAvailability>('Availability', availabilitySchema);
export default Availability;
