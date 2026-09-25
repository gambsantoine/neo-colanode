import { RichTextContent } from './markdown';

export type Page<T> = {
  data: T[];
  pagination: { limit: number; nextCursor: string | null; hasMore: boolean };
};

export type ApiNode = {
  id: string;
  workspaceId: string;
  spaceId: string;
  parentId: string | null;
  type: string;
  name: string | null;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
};

export type ApiDocument = {
  nodeId: string;
  content: RichTextContent | null;
  updatedAt: string | null;
};

export type ListParams = Record<string, string | number | undefined>;

export class ColanodeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

/** Thin client over the Colanode public API (`/api`), authenticated by an api key. */
export class ColanodeApi {
  private readonly baseUrl: string;

  constructor(
    serverUrl: string,
    private readonly apiKey: string
  ) {
    this.baseUrl = `${serverUrl.replace(/\/+$/, '')}/api`;
  }

  private async request<T>(
    method: string,
    path: string,
    options: { query?: ListParams; body?: unknown } = {}
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...(options.body !== undefined && {
          'content-type': 'application/json',
        }),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new ColanodeApiError(
        response.status,
        json?.code ?? 'unknown',
        json?.message ?? `Request failed with status ${response.status}`
      );
    }

    return json as T;
  }

  private spacePath(workspaceId: string, spaceId: string) {
    return `/workspaces/${encodeURIComponent(workspaceId)}/spaces/${encodeURIComponent(spaceId)}`;
  }

  listWorkspaces(query: ListParams) {
    return this.request<Page<Record<string, unknown>>>('GET', '/workspaces', {
      query,
    });
  }

  listSpaces(workspaceId: string, query: ListParams) {
    return this.request<Page<Record<string, unknown>>>(
      'GET',
      `/workspaces/${encodeURIComponent(workspaceId)}/spaces`,
      { query }
    );
  }

  listNodes(workspaceId: string, spaceId: string, query: ListParams) {
    return this.request<Page<ApiNode>>(
      'GET',
      `${this.spacePath(workspaceId, spaceId)}/nodes`,
      { query }
    );
  }

  async getNode(workspaceId: string, spaceId: string, nodeId: string) {
    const result = await this.request<{ data: ApiNode }>(
      'GET',
      `${this.spacePath(workspaceId, spaceId)}/nodes/${encodeURIComponent(nodeId)}`
    );
    return result.data;
  }

  async createNode(
    workspaceId: string,
    spaceId: string,
    attributes: Record<string, unknown>
  ) {
    const result = await this.request<{ data: ApiNode }>(
      'POST',
      `${this.spacePath(workspaceId, spaceId)}/nodes`,
      { body: { attributes } }
    );
    return result.data;
  }

  async updateNode(
    workspaceId: string,
    spaceId: string,
    nodeId: string,
    attributes: Record<string, unknown>
  ) {
    const result = await this.request<{ data: ApiNode }>(
      'PATCH',
      `${this.spacePath(workspaceId, spaceId)}/nodes/${encodeURIComponent(nodeId)}`,
      { body: { attributes } }
    );
    return result.data;
  }

  async getDocument(workspaceId: string, spaceId: string, nodeId: string) {
    const result = await this.request<{ data: ApiDocument }>(
      'GET',
      `${this.spacePath(workspaceId, spaceId)}/nodes/${encodeURIComponent(nodeId)}/document`
    );
    return result.data;
  }

  async putDocument(
    workspaceId: string,
    spaceId: string,
    nodeId: string,
    content: RichTextContent
  ) {
    const result = await this.request<{ data: ApiDocument }>(
      'PUT',
      `${this.spacePath(workspaceId, spaceId)}/nodes/${encodeURIComponent(nodeId)}/document`,
      { body: { content } }
    );
    return result.data;
  }
}
