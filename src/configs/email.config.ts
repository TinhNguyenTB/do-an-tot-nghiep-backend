import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import handlebars from "handlebars";

const templatesPath = path.join(__dirname, "../templates");

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Hàm load + compile template
export const renderTemplate = (templateName: string, context: any) => {
  const filePath = path.join(templatesPath, `${templateName}.hbs`);

  const templateFile = fs.readFileSync(filePath, "utf-8");

  const template = handlebars.compile(templateFile);

  return template(context);
};
