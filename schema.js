const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

exports.ideaSchema = new Schema(
  {
    _id: ObjectId,
    Title: String,
    Description: Object,
    ImageRefs: Array,
    Drafts: Array,
    CompletedWorks: Array,
    Completed: Boolean,
    Tags: Array,
    Project: Object,
    Inspirations: Array,
    DateCreated: String,
    Variant: String,
  },
  { minimize: false }
);

exports.projectSchema = new Schema(
  {
    _id: ObjectId,
    Title: String,
    Description: Object,
    Tags: Array,
    Ideas: Array,
    Completed: Boolean,
    DateCreated: String,
    Variant: String,
  },
  { minimize: false }
);

exports.inspirationSchema = new Schema(
  {
    _id: ObjectId,
    Title: String,
    Description: Object,
    ImageRefs: Array,
    Tags: Array,
    Ideas: Array,
    DateCreated: String,
    Variant: String,
  },
  { minimize: false }
);

exports.tagSchema = new Schema({
  _id: ObjectId,
  Title: String,
});
