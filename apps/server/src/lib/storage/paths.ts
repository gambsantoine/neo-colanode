const UNSAFE_FILE_NAME_CHARACTERS = /[/\\\0]/;
// Length of the `uploads.path` column.
const MAX_PATH_LENGTH = 255;

/**
 * Builds the storage path of a file upload. The file id, version and extension
 * are set by the client when it creates the node, so a value able to leave the
 * workspace directory is refused (returns null).
 */
export const buildFileUploadPath = (
  workspaceId: string,
  fileId: string,
  version: string,
  extension: string
): string | null => {
  const name = `${fileId}_${version}${extension}`;
  const path = `files/${workspaceId}/${name}`;

  if (UNSAFE_FILE_NAME_CHARACTERS.test(name) || path.length > MAX_PATH_LENGTH) {
    return null;
  }

  return path;
};
