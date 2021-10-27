const express = require("express");
const mongoose = require("mongoose");
const schemas = require("./schema");
const path = require("path");
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
    res.status(500).send(error);
  }
});

app.post("/item/:variant", async (req, res) => {
  const body = req.body;
  const { variant } = req.params;
  try {
    if (!body._id) body._id = new ObjectId();
    if (body.NewImageRefFiles) {
      for (let i = 0; i < body.NewImageRefFiles.length; i++) {
        const imageName = `${uuidv4()}.jpg`;
        await saveImage(body.NewImageRefFiles[i], body.Variant, imageName);
        if (body.ImageRefs) body.ImageRefs.push(imageName);
      }
    }
    if (body.ImageRefs) {
      for (let i = 0; i < body.ImageRefs.length; i++) {
        const image = body.ImageRefs[i];
        if (isURL(image)) {
          const imageName = `${uuidv4()}.jpg`;
          await downloadImage(body.ImageRefs[i], body.Variant, imageName);
          body.ImageRefs[i] = imageName;
        }
      }
    }
    delete body.NewImageRefFiles;
    if (variant === "idea") {
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
          if (err) return res.send(500, { error: err });
          return res.status(200).send();
        }
      );
    } else if (variant === "project") {
      projectModel.findOneAndUpdate(
        { _id: body._id },
        body,
        { upsert: true },
        (err, doc) => {
          if (err) return res.send(500, { error: err });
          return res.status(200).send();
        }
      );
    } else if (variant === "inspiration") {
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
          if (err) return res.send(500, { error: err });
          return res.status(200).send();
        }
      );
    } else if (variant === "tag") {
      tagModel.findOneAndUpdate(
        { _id: body._id },
        body,
        { upsert: true },
        (err, doc) => {
          if (err) return res.send(500, { error: err });
          return res.status(200).send();
        }
      );
    } else return res.status(500).send();
  } catch (error) {
    res.status(500).send(error);
  }
});

app.delete("/item/:variant/:id", async (req, res) => {
  try {
    const { id, variant } = req.params;
    if (variant === "idea") {
      ideaModel.findOneAndDelete({ _id: id }, {}, (err, doc) => {
        if (doc) {
          doc.ImageRefs.forEach((item) => removeImage(variant, item));
        }
        if (err) return res.send(500, { error: err });
        return res.status(200).send();
      });
    } else if (variant === "project") {
      projectModel.findOneAndDelete({ _id: id }, {}, (err, doc) => {
        if (err) return res.send(500, { error: err });
        return res.status(200).send();
      });
    } else if (variant === "inspiration") {
      inspirationModel.findOneAndDelete({ _id: id }, {}, (err, doc) => {
        if (doc) {
          doc.ImageRefs.forEach((item) => removeImage(variant, item));
        }
        if (err) return res.send(500, { error: err });
        return res.status(200).send();
      });
    } else if (variant === "tag") {
      tagModel.findOneAndDelete({ _id: id }, {}, (err, doc) => {
        if (err) return res.send(500, { error: err });
        return res.status(200).send();
      });
    } else return res.status(500).send();
  } catch (error) {
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
