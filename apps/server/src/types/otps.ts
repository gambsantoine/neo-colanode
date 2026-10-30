export type AccountVerifyOtpAttributes = {
  accountId: string;
};

export type AccountPasswordResetOtpAttributes = {
  accountId: string;
};

export type Otp<T> = {
  id: string;
  expiresAt: string;
  otp: string;
  attributes: T;
};
