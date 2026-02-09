export interface SubmissionFormData {
  fullName: string;
  phoneNumber: string;
  location: string;
  email: string;
  hobbies: string;
  profilePicture: File | null;
  sourceCode: File | null;
}

export interface FormErrors {
  fullName?: string;
  phoneNumber?: string;
  location?: string;
  email?: string;
  hobbies?: string;
  profilePicture?: string;
  sourceCode?: string;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  // Accept phone numbers with 7-15 digits
  return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

export function validateSubmissionForm(data: SubmissionFormData): FormErrors {
  const errors: FormErrors = {};

  // Full Name validation
  if (!data.fullName.trim()) {
    errors.fullName = 'Full name is required';
  } else if (data.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters';
  } else if (data.fullName.trim().length > 100) {
    errors.fullName = 'Full name must be less than 100 characters';
  }

  // Phone Number validation
  if (!data.phoneNumber.trim()) {
    errors.phoneNumber = 'Phone number is required';
  } else if (!validatePhoneNumber(data.phoneNumber)) {
    errors.phoneNumber = 'Please enter a valid phone number';
  }

  // Location validation
  if (!data.location.trim()) {
    errors.location = 'Location is required';
  } else if (data.location.trim().length < 2) {
    errors.location = 'Location must be at least 2 characters';
  } else if (data.location.trim().length > 100) {
    errors.location = 'Location must be less than 100 characters';
  }

  // Email validation
  if (!data.email.trim()) {
    errors.email = 'Email address is required';
  } else if (!validateEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }

  // Hobbies validation
  if (!data.hobbies.trim()) {
    errors.hobbies = 'Please tell us about your hobbies and interests';
  } else if (data.hobbies.trim().length < 20) {
    errors.hobbies = 'Please provide more detail (at least 20 characters)';
  } else if (data.hobbies.trim().length > 1000) {
    errors.hobbies = 'Please keep your response under 1000 characters';
  }

  // Profile Picture validation
  if (!data.profilePicture) {
    errors.profilePicture = 'Profile picture is required';
  }

  // Source Code validation
  if (!data.sourceCode) {
    errors.sourceCode = 'Source code file is required';
  } else if (!data.sourceCode.name.endsWith('.zip')) {
    errors.sourceCode = 'Source code must be a .zip file';
  } else if (data.sourceCode.size > 50 * 1024 * 1024) {
    errors.sourceCode = 'Source code file must be less than 50MB';
  }

  return errors;
}