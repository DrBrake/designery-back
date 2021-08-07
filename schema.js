const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

exports.ideaSchema = new Schema({
  _id: ObjectId,
  Title: String,
  Description: String,
  ImageRefs: Array,
  Drafts: Array,
  CompletedWorks: Array,
  Completed: Boolean,
  Tags: Array,
  Project: String,
  Inspirations: Array,
  DateCreated: String,
  Variant: String,
});

exports.projectSchema = new Schema({
  _id: ObjectId,
  Title: String,
  Description: String,
  Ideas: Array,
  DateCreated: String,
  Variant: String,
});

exports.inspirationSchema = new Schema({
  _id: ObjectId,
  Title: String,
  ImageRefs: Array,
  Ideas: Array,
  DateCreated: String,
  Variant: String,
});

exports.tagSchema = new Schema({
  _id: ObjectId,
  Title: String,
});