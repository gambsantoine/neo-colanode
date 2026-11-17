export type Account = {
  id: string;
  name: string;
  // Public name, shown instead of the real one outside the workspace.
  username?: string | null;
  email: string;
  avatar?: string | null;
  token: string;
  deviceId: string;
  server: string;
  createdAt: string;
  updatedAt: string | null;
  syncedAt: string | null;
};
