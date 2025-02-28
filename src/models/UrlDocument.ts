import mongoose, { Schema, Document } from 'mongoose';

export interface IUrlDocument extends Document {
  url: string;
  pageTitle: string;
}

const UrlDocumentSchema: Schema = new Schema({
  url: { type: String, required: true },
  pageTitle: { type: String, required: true }
});

export default mongoose.model<IUrlDocument>('UrlDocument', UrlDocumentSchema);