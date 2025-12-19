import { renderTemplate, transporter } from "@/configs/email.config";

export const sendMailTemplate = async ({
  to,
  subject,
  template,
  context,
}: {
  to: string;
  subject: string;
  template: string;
  context: any;
}) => {
  const html = renderTemplate(template, context);

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
};
