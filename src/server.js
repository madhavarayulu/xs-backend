import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    const allowedOrigins = [
      'http://localhost:5173', // Your local frontend
      'https://your-production-frontend.com', // Production frontend
      undefined, // for postman or server-to-server requests
    ];

    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
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
