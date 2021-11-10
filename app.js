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
    if (body.Inspirations) {
      for (let i = 0; i < body.Inspirations.length; i++) {
        const inspiration = body.Inspirations[i];
        if (!inspiration.Ideas) inspiration.Ideas = [];
        if (!inspiration.Ideas.some((item) => item._id === body._id)) {
          inspiration.Ideas.push({
            _id: body._id,
            Title: body.Title,
          });
        }
        if (!inspiration._id) {
          inspiration._id = new ObjectId();
          inspiration.DateCreated = dayjs().format();
          await inspirationModel.create(inspiration);
        } else {
          await inspirationModel.findOneAndUpdate(
            { _id: inspiration._id, "Ideas._id": { $ne: body._id } },
            {
              $addToSet: {
                Ideas: { _id: body._id, Title: body.Title },
              },
            }
          );
        }
      }
    }
    if (body.Project) {
      const project = body.Project;
      if (!project.Ideas) project.Ideas = [];
      if (!project.Ideas.some((item) => item._id === body._id)) {
        project.Ideas.push({
          _id: body._id,
          Title: body.Title,
        });
      }
      await projectModel.findOneAndUpdate(
        { _id: project._id, "Ideas._id": { $ne: body._id } },
        {
          $addToSet: {
            Ideas: { _id: body._id, Title: body.Title },
          },
        }
      );
    } else {
      body.Project = null;
    }

    if (variant === "idea") {
      ideaModel.findOneAndUpdate(
        { _id: body._id },
        body,
        { upsert: true },
        async (err, doc) => {
          if (doc) {
            doc.ImageRefs.forEach((item) => {
              if (!body.ImageRefs.includes(item)) {
                removeImage(variant, item);
              }
            });
            if (body.Project !== doc.Project) {
              await projectModel.findOneAndUpdate(
                { _id: doc.Project._id },
                { $pull: { Ideas: { _id: doc._id } } }
              );
            }
            const removedInspirations = doc.Inspirations.filter(
              (item) => !body.Inspirations.includes(item)
            ).map((item) => item._id);
            await inspirationModel.updateMany(
              { _id: { $in: removedInspirations } },
              { $pull: { Ideas: { _id: doc._id } } }
            );
            if (body.Title !== doc.Title) {
              await inspirationModel.updateMany(
                { "Ideas._id": doc._id },
                { $set: { "Ideas.$.Title": body.Title } }
              );
              await projectModel.updateOne(
                { "Ideas._id": doc._id },
                { $set: { "Ideas.$.Title": body.Title } }
              );
            }
          }
          if (err) {
            console.log(err);
            return res.send(500, { error: err });
          }
          return res.status(200).send();
        }
      );
    } else if (variant === "project") {
      projectModel.findOneAndUpdate(
        { _id: body._id },
        body,
        { upsert: true },
        async (err, doc) => {
          if (doc) {
            const removedIdeas = doc.Ideas.filter(
              (item) => !body.Ideas.includes(item)
            ).map((item) => item._id);
            await ideaModel.updateMany(
              { _id: { $in: removedIdeas } },
              { $set: { Project: null } }
            );
            if (body.Title !== doc.Title) {
              await ideaModel.updateMany(
                { "Project._id": doc._id },
                { $set: { "Project.Title": body.Title } }
              );
            }
          }
          if (err) {
            console.log(err);
            return res.send(500, { error: err });
          }
          return res.status(200).send();
        }
      );
    } else if (variant === "inspiration") {
      inspirationModel.findOneAndUpdate(
        { _id: body._id },
        body,
        { upsert: true },
        async (err, doc) => {
          if (doc) {
            doc.ImageRefs.forEach((item) => {
              if (!body.ImageRefs.includes(item)) {
                removeImage(variant, item);
              }
            });
            const removedIdeas = doc.Ideas.filter(
              (item) => !body.Ideas.includes(item)
            ).map((item) => item._id);
            await ideaModel.updateMany(
              { _id: { $in: removedIdeas } },
              {
                $pull: {
                  Inspirations: { _id: doc._id },
                },
              }
            );
            if (body.Title !== doc.Title) {
              await ideaModel.updateMany(
                { "Inspirations._id": doc._id },
                { $set: { "Inspirations.$.Title": body.Title } }
              );
            }
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
        if (doc) {
          await ideaModel.updateMany(
            { "Project._id": doc._id },
            { $set: { Project: null } }
          );
        }
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
