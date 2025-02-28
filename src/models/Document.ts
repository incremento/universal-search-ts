import mongoose, { Schema, Document as MongoDocument } from 'mongoose';

export interface IDocument extends MongoDocument {
  title: string;
  content: string;
  signalUrl: string;
  publishedDate: Date;
  classification: string;
}

const DocumentSchema: Schema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  signalUrl: { type: String, required: true },
  publishedDate: { type: Date, default: Date.now },
  classification: { type: String, default: 'unclassified' }
});

export default mongoose.model<IDocument>('Document', DocumentSchema);