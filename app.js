const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const schemas = require('./schema');
const fs = require('fs');

const app = express();

const ideaModel = mongoose.model('Idea', schemas.ideaSchema, 'ideas');
const projectModel = mongoose.model('Project', schemas.projectSchema, 'projects');
const inspirationModel = mongoose.model('Inspiration', schemas.inspirationSchema, 'inspirations');
const tagModel = mongoose.model('Tag', schemas.tagSchema, 'tags');
const ObjectId = mongoose.Types.ObjectId;

const dir = path.join(__dirname, 'public');

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.json());

mongoose.connect('mongodb://127.0.0.1:27017/designery', { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', () => {
  console.log("Database connection established successfully");
});

app.get('/', async (req, res) => {
  try {
    const ideaQuery = ideaModel.find().exec();
    const projectQuery = projectModel.find().exec();
    const inspirationQuery = inspirationModel.find().exec();
    const tagQuery = tagModel.find().exec();
    let [ideas, projects, inspirations, tags] = await Promise.all([ideaQuery, projectQuery, inspirationQuery, tagQuery]);
    res.send({ ideas, projects, inspirations, tags });
  } catch(error) {
    res.status(500).send(error);
  }
});

app.post('/idea', async (req, res) => {
  const body = req.body;
  try {
    console.log(body);
  } catch(error) {
    res.status(500).send(error);
  }
});

app.post('/project', async (req, res) => {
  const body = req.body;
  try {
    console.log(body);
  } catch(error) {
    res.status(500).send(error);
  }
});

app.post('/inspiration', async (req, res) => {
  const body = req.body;
  try {
    console.log(body);
  } catch(error) {
    res.status(500).send(error);
  }
});

app.post('/tag', async (req, res) => {
  const body = req.body;
  try {
    console.log(body);
  } catch(error) {
    res.status(500).send(error);
  }
});

app.listen(8081, () => { console.log('Listening at port 8081') });