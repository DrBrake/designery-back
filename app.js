const express = require("express");
const mongoose = require("mongoose");
const schemas = require("./schema");
const path = require("path");
const dayjs = require("dayjs");
const { v4: uuidv4 } = require("uuid");

const {
  isURL,
  getImage,
  saveImage,
  downloadImage,
  removeImage,
} = require("./utils");

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

const dir = path.join(__dirname, "public");

const ideaModel = mongoose.model("Idea", schemas.ideaSchema, "ideas");
const projectModel = mongoose.model(
  "Project",
  schemas.projectSchema,
  "projects"
);
const inspirationModel = mongoose.model(
  "Inspiration",
  schemas.inspirationSchema,
  "inspirations"
);
const tagModel = mongoose.model("Tag", schemas.tagSchema, "tags");
const ObjectId = mongoose.Types.ObjectId;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE");
  next();
});

app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/designery", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "Connection error:"));
db.once("open", () => {
  console.log("Database connection established successfully");
});

app.get("/", async (req, res) => {
  try {
    const ideaQuery = ideaModel.find().exec();
    const projectQuery = projectModel.find().exec();
    const inspirationQuery = inspirationModel.find().exec();
    const tagQuery = tagModel.find().exec();
    let [ideas, projects, inspirations, tags] = await Promise.all([
      ideaQuery,
      projectQuery,
      inspirationQuery,
      tagQuery,
    ]);
    res.send({ ideas, projects, inspirations, tags });
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.post("/item/:variant", async (req, res) => {
  const body = req.body;
  const { variant } = req.params;
  try {
    if (!body._id) body._id = new ObjectId();
    if (body.ImageRefs) {
      for (let i = 0; i < body.ImageRefs.length; i++) {
        const image = body.ImageRefs[i];
        if (typeof image === "string" && isURL(image)) {
          const imageName = `${uuidv4()}.jpg`;
          await downloadImage(body.ImageRefs[i], body.Variant, imageName);
          body.ImageRefs[i] = imageName;
        } else if (image.file) {
          const imageName = `${uuidv4()}.jpg`;
          await saveImage(body.ImageRefs[i], body.Variant, imageName);
          body.ImageRefs[i] = imageName;
        }
      }
    }
    if (body.Tags) {
      for (let i = 0; i < body.Tags.length; i++) {
        const tag = body.Tags[i];
        if (!tag._id) {
          tag._id = new ObjectId();
          await tagModel.create(tag);
        }
      }
    }
    // Only add simple versions of Inspiration and Project to Idea?
    if (body.Inspirations) {
      for (let i = 0; i < body.Inspirations.length; i++) {
        const inspiration = body.Inspirations[i];
        if (!inspiration.Ideas) inspiration.Ideas = [];
        if (!inspiration.Ideas.some((item) => item._id === body._id)) {
          inspiration.Ideas.push({
            _id: ObjectId(body._id),
            Title: body.Title,
          });
        }
        if (inspiration._id) inspiration._id = ObjectId(inspiration._id);
        else {
          inspiration._id = new ObjectId();
          inspiration.DateCreated = dayjs().format();
          await inspirationModel.create(inspiration);
        }
      }
    }
    if (body.Project) {
      const project = body.Project;
      if (!project.Ideas) project.Ideas = [];
      if (!project.Ideas.some((item) => item._id === body._id)) {
        project.Ideas.push({
          _id: ObjectId(body._id),
          Title: body.Title,
        });
      }
      if (project._id) project._id = ObjectId(project._id);
      await projectModel.findOneAndUpdate(
        { _id: body.Project._id },
        {
          $addToSet: {
            Ideas: { _id: ObjectId(body._id), Title: body.Title },
          },
        }
      );
    }
    if (variant === "idea") {
      // Update Titles in Inspirations and Projects
      ideaModel.findOneAndUpdate(
        { _id: body._id },
        body,
        { upsert: true },
        (err, doc) => {
          if (doc) {
            doc.ImageRefs.forEach((item) => {
              if (!body.ImageRefs.includes(item)) {
                removeImage(variant, item);
              }
            });
          }
          if (err) {
            console.log(err);
            return res.send(500, { error: err });
          }
          return res.status(200).send();
        }
      );
    } else if (variant === "project") {
      // Update Titles in Ideas
      projectModel.findOneAndUpdate(
        { _id: body._id },
        body,
        { upsert: true },
        (err, doc) => {
          if (err) {
            console.log(err);
            return res.send(500, { error: err });
          }
          return res.status(200).send();
        }
      );
    } else if (variant === "inspiration") {
      // Update Titles in Ideas
      inspirationModel.findOneAndUpdate(
        { _id: body._id },
        body,
        { upsert: true },
        (err, doc) => {
          if (doc) {
            doc.ImageRefs.forEach((item) => {
              if (!body.ImageRefs.includes(item)) {
                removeImage(variant, item);
              }
            });
          }
          if (err) {
            console.log(err);
            return res.send(500, { error: err });
          }
          return res.status(200).send();
        }
      );
    } else return res.status(500).send();
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.delete("/item/:variant/:id", async (req, res) => {
  try {
    const { id, variant } = req.params;
    if (variant === "idea") {
      await ideaModel.findOneAndDelete({ _id: id }, {}, async (err, doc) => {
        if (doc) {
          doc.ImageRefs.forEach((item) => removeImage(variant, item));
          if (doc.Project) {
            await projectModel.findOneAndUpdate(
              { _id: doc.Project._id },
              { $pull: { Ideas: { _id: doc._id } } }
            );
          }
          if (doc.Inspirations) {
            await inspirationModel.updateMany(
              {},
              { $pull: { Ideas: { _id: doc._id } } }
            );
          }
        }
        if (err) {
          console.log(err);
          return res.send(500, { error: err });
        }
        return res.status(200).send();
      });
    } else if (variant === "project") {
      await projectModel.findOneAndDelete({ _id: id }, {}, async (err, doc) => {
        await ideaModel.updateMany(
          { "Project._id": doc._id },
          { $set: { Project: null } }
        );
        if (err) {
          console.log(err);
          return res.send(500, { error: err });
        }
        return res.status(200).send();
      });
    } else if (variant === "inspiration") {
      await inspirationModel.findOneAndDelete(
        { _id: id },
        {},
        async (err, doc) => {
          if (doc) {
            doc.ImageRefs.forEach((item) => removeImage(variant, item));
            await ideaModel.updateMany(
              {},
              {
                $pull: {
                  Inspirations: { _id: doc._id },
                },
              }
            );
          }
          if (err) {
            console.log(err);
            return res.send(500, { error: err });
          }
          return res.status(200).send();
        }
      );
    } else return res.status(500).send();
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.get("/images/:variant/:image", async (req, res) => {
  try {
    const data = await getImage(
      `${dir}/images/${req.params.variant}/${req.params.image}`,
      req.query
    );
    if (data) {
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": data.length,
        "Cache-Control": "public, max-age=86400",
      });
      res.end(data);
    } else res.status(500).send();
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.listen(8081, () => {
  console.log("Listening at port 8081");
});
