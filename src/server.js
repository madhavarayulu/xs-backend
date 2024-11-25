import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

// Load environment variables
dotenv.config();

const app = express();

// Multer configuration for handling file uploads
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error('Invalid file type. Only PDF and Word documents are allowed.')
      );
    }
  },
});

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173', // Your local frontend
      'https://xs-gamma.vercel.app', // Production frontend
      undefined, // for postman or server-to-server requests
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // e.g., 'smtp.gmail.com'
  port: 587, // Usually 587 for TLS
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Validate job application input
const validateJobApplication = (data) => {
  const errors = {};

  if (!data.firstName?.trim()) {
    errors.firstName = 'First name is required';
  }

  if (!data.lastName?.trim()) {
    errors.lastName = 'Last name is required';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.email = 'Valid email is required';
  }

  const phoneRegex = /^\+?[\d\s-()]{10,}$/;
  if (!data.phone || !phoneRegex.test(data.phone)) {
    errors.phone = 'Valid phone number is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Handle job application submission
app.post('/api/job-application', upload.single('resume'), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, jobTitle, jobLocation } =
      req.body;

    // Validate input
    const { isValid, errors } = validateJobApplication(req.body);
    if (!isValid) {
      return res.status(400).json({ errors });
    }

    if (!req.file) {
      return res.status(400).json({
        errors: { file: 'Resume is required' },
      });
    }

    // Email to client/HR
    const mailOptions = {
      from: `"Job Application" <${process.env.EMAIL_USER}>`,
      to: process.env.CLIENT_EMAIL,
      cc: process.env.HR_EMAIL, // Add HR email in .env
      subject: `Xemsoft | New Job Application | ${jobTitle} | ${jobLocation} - ${firstName} ${lastName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Job Application</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Name:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${firstName} ${lastName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Email:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Phone:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${phone}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Job Title:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${jobTitle}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Job Location:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${jobLocation}</td>
            </tr>
          </table>
        </div>
      `,
      attachments: [
        {
          filename: req.file.originalname,
          content: req.file.buffer,
          contentType: req.file.mimetype,
        },
      ],
    };

    // Acknowledgment email to applicant
    const applicantMailOptions = {
      from: `"Xemsoft" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "We've Received Your Job Application",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Thank You for Your Application!</h2>
          <p>Hi ${firstName},</p>
          <p>We've received your job application for the position of <strong>${jobTitle}</strong> in <strong>${jobLocation}</strong> and will review it shortly.</p>
          <p>Our hiring team will contact you if your qualifications match our requirements.</p>
          <br>
          <p>Best regards,<br>Xemsoft</p>
        </div>
      `,
    };

    // Send both emails
    await Promise.all([
      transporter.sendMail(mailOptions),
      transporter.sendMail(applicantMailOptions),
    ]);

    res.status(200).json({
      message: "Application submitted successfully. We'll be in touch soon!",
    });
  } catch (error) {
    console.error('Job application submission error:', error);
    res.status(500).json({
      message: 'Failed to submit application. Please try again later.',
      error: error.message,
    });
  }
});

// Validate form input
const validateFormInput = (data) => {
  const errors = {};

  // Name validation
  if (!data.name || data.name.trim().length < 2) {
    errors.name = 'Valid name is required';
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.email = 'Valid email is required';
  }

  // Phone validation (optional)
  if (data.fullPhoneNumber) {
    // Remove any non-digit characters
    const cleanedPhone = data.fullPhoneNumber.replace(/\D/g, '');

    // Check for valid international phone number length (10-15 digits)
    if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
      errors.phone = 'Invalid phone number length';
    }
  }

  // Subject validation
  if (!data.subject || data.subject.trim().length < 3) {
    errors.subject = 'Subject is required';
  }

  // Message validation
  if (!data.message || data.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Route to handle contact form submission
app.post('/api/contact', async (req, res) => {
  console.log(req.body); // Check the received body
  try {
    // Validate input
    const { isValid, errors } = validateFormInput(req.body);
    if (!isValid) {
      return res.status(400).json({ errors });
    }

    const { name, email, fullPhoneNumber, subject, message } = req.body;

    // Email to client (your company email)
    const clientMailOptions = {
      from: `"Contact Form" <${process.env.EMAIL_USER}>`,
      to: process.env.CLIENT_EMAIL, // Your client's email
      cc: process.env.HR_EMAIL,
      subject: `Xemsoft | New Contact Form Submission: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Name:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Email:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${email}</td>
            </tr>
            ${
              fullPhoneNumber
                ? `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Phone:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${fullPhoneNumber}</td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Subject:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${subject}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Message:</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${message}</td>
            </tr>
          </table>
        </div>
      `,
    };

    // Acknowledgment email to user
    const userMailOptions = {
      from: `"Xemsoft" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "We've Received Your Message",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Thank You for Contacting Us!</h2>
          <p>Hi ${name},</p>
          <p>We've received your message regarding "${subject}" and will get back to you soon.</p>
          <p>Our team will review your inquiry and respond within the next 1-2 business days.</p>
          <br>
          <p>Best regards,<br>Xemsoft</p>
        </div>
      `,
    };

    // Send emails
    await Promise.all([
      transporter.sendMail(clientMailOptions),
      transporter.sendMail(userMailOptions),
    ]);

    // Respond to the client
    res.status(200).json({
      message: "Form submitted successfully. We'll be in touch soon!",
    });
  } catch (error) {
    console.error('Contact form submission error:', error);
    res.status(500).json({
      message: 'Failed to submit form. Please try again later.',
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'An unexpected error occurred',
    error: err.message,
  });
});

// Server configuration
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
