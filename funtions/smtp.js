const nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    this.emailfile = path.join(__dirname, "../jsonfiles/smtpconf.json");
    this.debugFlag = true; // Change this to false if you want to send emails. If true, it'll just console log.
  }

  async send(smtpmessage) {
    if (this.debugFlag) {
      // If debugFlag is true, just log the message and return
      console.log("DEBUG MODE: ", smtpmessage);
      return;
    }

    // Read SMTP config from the file
    let emailsetup = fs.readFileSync(this.emailfile, 'utf-8');
    let smtpConfig = JSON.parse(emailsetup);
    let smtpto = smtpConfig.Sendto.map(item => item.email).join(', ');

    // SMTP config
    const transporter = nodemailer.createTransport({
      host: "smtp.global.dish.com",
      tls: {
        rejectUnauthorized: false,
      },
      port: 25,
      secure: false,
      auth: {
        user: "", // Your Ethereal Email address
        pass: "", // Your Ethereal Email password
      },
    });

    // Send the email
    let info = await transporter.sendMail({
      from: '"Test2Engineer" <smtp@ElpTE.dish.com>',
      to: smtpto, 
      subject: "automated smtep email from CHY-ELPLABVEWP1.echostar.com",
      text: smtpmessage,
    });
    
    const result = info.accepted.toString();
    console.log("Message sent: %s", info.messageId);
  }
}

module.exports = EmailService;
