export type AccountVerifyOtpAttributes = {
  accountId: string;
  purpose: 'email_verify';
};

export type AccountPasswordResetOtpAttributes = {
  accountId: string;
  purpose: 'password_reset';
};

export type AccountOtpAttributes =
  | AccountVerifyOtpAttributes
  | AccountPasswordResetOtpAttributes;

export type AccountOtpPurpose = AccountOtpAttributes['purpose'];

export type Otp<T> = {
  id: string;
  expiresAt: string;
  otp: string;
  attributes: T;
};
