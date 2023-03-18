const express = require("express");
const mongoose = require("mongoose");
const schemas = require("./schema");
const path = require("path");
const dayjs = require("dayjs");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

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

const SECRET_KEY = "Seecrets!";

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
const userModel = mongoose.model("User", schemas.userSchema, "users");

const ObjectId = mongoose.Types.ObjectId;

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, authorization"
  );
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE");
  next();
});

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

const isTokenValid = (req) => {
  let token = req.headers["authorization"];
  if (token) {
    token = token.split("Bearer ")[1];
    const decoded = jwt.verify(token, SECRET_KEY);
    if (decoded) return true;
  }
  return false;
};

const filterSecretValues = (array) => {
  return array.filter((val) => !val.Secret);
};

app.get("/", async (req, res) => {
  try {
    const validToken = isTokenValid(req);
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
    if (validToken) {
      res.send({ ideas, projects, inspirations, tags });
    } else {
      res.send({
        ideas: filterSecretValues(ideas),
        projects: filterSecretValues(projects),
        inspirations: filterSecretValues(inspirations),
        tags: filterSecretValues(tags),
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

const postIdea = async (body) => {
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

  ideaModel.findOneAndUpdate(
    { _id: body._id },
    body,
    { upsert: true },
    async (error, doc) => {
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
        return Promise.resolve();
      }
      if (error) {
        throw error;
      }
    }
  );
};

app.post("/item/idea", async (req, res) => {
  try {
    await postIdea(req.body);
    return res.status(200).send();
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

const postInspiration = async (body) => {
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
  if (body.Ideas) {
    for (let i = 0; i < body.Ideas.length; i++) {
      const idea = body.Ideas[i];
      if (!idea.Inspirations) idea.Inspirations = [];
      if (!idea.Inspirations.some((item) => item._id === body._id)) {
        idea.Inspirations.push({
          _id: body._id,
          Title: body.Title,
        });
      }
      if (!idea._id) {
        idea._id = new ObjectId();
        idea.DateCreated = dayjs().format();
        await ideaModel.create(idea);
      } else {
        await ideaModel.findOneAndUpdate(
          { _id: idea._id, "Inspirations._id": { $ne: body._id } },
          {
            $addToSet: {
              Inspirations: { _id: body._id, Title: body.Title },
            },
          }
        );
      }
    }
  }

  inspirationModel.findOneAndUpdate(
    { _id: body._id },
    body,
    { upsert: true },
    async (error, doc) => {
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
        return Promise.resolve();
      }
      if (error) {
        throw error;
      }
    }
  );
};

app.post("/item/inspiration", async (req, res) => {
  try {
    await postInspiration(req.body);
    return res.status(200).send();
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

const postProject = async (body) => {
  if (!body._id) body._id = new ObjectId();
  if (body.Tags) {
    for (let i = 0; i < body.Tags.length; i++) {
      const tag = body.Tags[i];
      if (!tag._id) {
        tag._id = new ObjectId();
        await tagModel.create(tag);
      }
    }
  }
  if (body.Ideas) {
    for (let i = 0; i < body.Ideas.length; i++) {
      const idea = body.Ideas[i];
      if (!idea._id) {
        idea._id = new ObjectId();
        idea.DateCreated = dayjs().format();
        idea.Project = { _id: body._id, Title: body.Title };
        await ideaModel.create(idea);
      } else {
        await ideaModel.findOneAndUpdate(
          { _id: idea._id },
          {
            $set: {
              Project: { _id: body._id, Title: body.Title },
            },
          }
        );
      }
    }
  }

  projectModel.findOneAndUpdate(
    { _id: body._id },
    body,
    { upsert: true },
    async (error, doc) => {
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
        return Promise.resolve();
      }
      if (error) {
        throw error;
      }
    }
  );
};

app.post("/item/project", async (req, res) => {
  try {
    await postProject(req.body);
    return res.status(200).send();
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

app.post("/item/multiple", async (req, res) => {
  const body = req.body;
  for (let i = 0; i < body.length; i++) {
    if (body[i].Variant === "idea") {
      await postIdea(body[i]);
    } else if (body[i].Variant === "inspiration") {
      await postInspiration(body[i]);
    } else if (body[i].Variant === "project") {
      await postProject(body[i]);
    }
  }
  return res.status(200).send();
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

app.post("/tag", async (req, res) => {
  const body = req.body;
  await tagModel.findOneAndUpdate(
    { _id: body._id },
    body,
    { upsert: true },
    async (err, doc) => {
      if (doc) {
        if (body.Title !== doc.Title) {
          await ideaModel.updateMany(
            { "Tags._id": doc._id },
            { $set: { "Tags.$.Title": body.Title } }
          );
          await inspirationModel.updateMany(
            { "Tags._id": doc._id },
            { $set: { "Tags.$.Title": body.Title } }
          );
          await projectModel.updateMany(
            { "Tags._id": doc._id },
            { $set: { "Tags.$.Title": body.Title } }
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
});

app.delete("/tag", async (req, res) => {
  const body = req.body;
  await tagModel.findOneAndDelete({ _id: body._id }, {}, async (err, doc) => {
    if (doc) {
      await ideaModel.updateMany({}, { $pull: { Tags: { _id: doc._id } } });
      await inspirationModel.updateMany(
        {},
        { $pull: { Tags: { _id: doc._id } } }
      );
      await projectModel.updateMany({}, { $pull: { Tags: { _id: doc._id } } });
    }
    if (err) {
      console.log(err);
      return res.send(500, { error: err });
    }
    return res.status(200).send();
  });
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

app.post("/login", async (req, res) => {
  const UserName = req.params.UserName;
  const Password = req.params.Password;
  const exists = await userModel.find({
    UserName: UserName,
    Password: Password,
  });
  if (exists) {
    const token = jwt.sign(
      { UserName: UserName, Password: Password },
      SECRET_KEY,
      { expiresIn: "1d" }
    );
    return res.status(200).send({ token });
  }
  res.status(401).send();
});

app.listen(8081, () => {
  console.log("Listening at port 8081");
});
