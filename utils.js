const sharp = require("sharp");
const Axios = require("axios");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "public");

const isURL = (url) => {
  if (url) {
    const regex = new RegExp(
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi
    );
    return url.match(regex);
  }
  return false;
};

const saveImage = (inputFile, variant, imageName) => {
  try {
    const img = inputFile.file.split(";base64,").pop();
    const imageBuffer = Buffer.from(img, "base64");
    return sharp(imageBuffer)
      .jpeg({ quality: 100 })
      .toFile(`${dir}/images/${variant}/${imageName}`);
  } catch (err) {
    return Promise.reject(err);
  }
};

const downloadImage = async (url, variant, imageName) => {
  const response = await Axios({ url, method: "GET", responseType: "stream" });
  const filePath = `${dir}/images/${variant}/${imageName}`;
  return new Promise((resolve, reject) => {
    response.data
      .pipe(fs.createWriteStream(filePath))
      .on("error", reject)
      .once("close", () => resolve(filePath));
  });
};

exports.isURL = isURL;
exports.saveImage = saveImage;
exports.downloadImage = downloadImage;
