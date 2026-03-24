import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const arg = process.argv[2];

const SettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: ['ourWorkStats', 'promotionalDiscount'],
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
const Settings = mongoose.model('Settings', SettingsSchema);

async function check() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to DB');
  
  if (arg === 'update') {
    const res = await Settings.findOneAndUpdate(
      { key: 'ourWorkStats' },
      { data: { videosEdited: '99k+', clientTimeSaved: '999k+', organicViews: '1B+', timeSavedPerClient: '8h/Day' } },
      { upsert: true, new: true, runValidators: true }
    );
    console.log('Update Result:', res);
  }

  const result = await Settings.findOne({ key: 'ourWorkStats' });
  console.log('Find Result:', result);
  
  process.exit(0);
}
check();
