const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const BaseItem = { _id: ObjectId, Title: String };

exports.ideaSchema = new Schema(
  {
    _id: ObjectId,
    Title: String,
    Description: Object,
    ImageRefs: [String],
    Drafts: [String],
    CompletedWorks: [String],
    Completed: Boolean,
    Tags: [BaseItem],
    Project: BaseItem,
    Inspirations: [BaseItem],
    DateCreated: String,
    Variant: String,
    Secret: Boolean,
  },
  { minimize: false }
);

exports.projectSchema = new Schema(
  {
    _id: ObjectId,
    Title: String,
    Description: Object,
    Tags: [BaseItem],
    Ideas: [BaseItem],
    Completed: Boolean,
    DateCreated: String,
    Variant: String,
    Secret: Boolean,
  },
  { minimize: false }
);

exports.inspirationSchema = new Schema(
  {
    _id: ObjectId,
    Title: String,
    Description: Object,
    ImageRefs: [String],
    Tags: [BaseItem],
    Ideas: [BaseItem],
    Completed: Boolean,
    DateCreated: String,
    Variant: String,
    Secret: Boolean,
  },
  { minimize: false }
);

exports.tagSchema = new Schema({
  _id: ObjectId,
  Title: String,
  Secret: Boolean,
});

exports.userSchema = new Schema({
  _id: ObjectId,
  UserName: String,
  Password: String,
});
