import { Bot, Check, ChevronRight, Copy } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@colanode/ui/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@colanode/ui/components/ui/collapsible';
import { Link } from '@colanode/ui/components/ui/link';
import { useServer } from '@colanode/ui/contexts/server';

const MCP_PACKAGE_URL =
  'https://github.com/gambsantoine/neo-colanode/releases/download/mcp-v1.0.1/colanode-mcp-1.0.1.tgz';

const API_KEY_PLACEHOLDER = '<your api key>';

const buildClaudeCodeCommand = (serverUrl: string) =>
  `claude mcp add colanode \\
  -e COLANODE_URL=${serverUrl} \\
  -e COLANODE_API_KEY=${API_KEY_PLACEHOLDER} \\
  -- npx -y ${MCP_PACKAGE_URL}`;

const buildClientConfig = (serverUrl: string) =>
  `{
  "mcpServers": {
    "colanode": {
      "command": "npx",
      "args": ["-y", "${MCP_PACKAGE_URL}"],
      "env": {
        "COLANODE_URL": "${serverUrl}",
        "COLANODE_API_KEY": "${API_KEY_PLACEHOLDER}"
      }
    }
  }
}`;

const InlineCode = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
    {children}
  </code>
);

const CopyableCode = ({ code, label }: { code: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  // The clipboard api is missing on plain http pages, hence the catch.
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      toast.error('Could not copy to the clipboard.');
    }
  };

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border bg-muted p-3 pr-14 font-mono text-xs">
        {code}
      </pre>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="absolute right-2 top-2"
        aria-label={label}
        onClick={handleCopy}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
};

interface McpSetupNoteProps {
  /** False on pages without a create button, which link to the account page. */
  canCreateKeysHere: boolean;
}

export const McpSetupNote = ({ canCreateKeysHere }: McpSetupNoteProps) => {
  const server = useServer();
  // configUrl is the backend base url, path prefix included, plus /config.
  const serverUrl = server.configUrl.replace(/\/config$/, '');

  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-3 p-3 text-left">
        <Bot className="size-5 text-muted-foreground shrink-0" />
        <span className="grow text-sm font-medium">
          Connect an AI assistant with MCP
        </span>
        <ChevronRight className="size-4 text-muted-foreground shrink-0 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 border-t p-3 text-sm text-muted-foreground">
          <p>
            Connect an AI assistant (Claude, Cursor...) to Colanode so it can
            read and write your pages.
          </p>
          <div className="space-y-1">
            <p className="font-medium text-foreground">Requirements</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Node.js 20 or later.</li>
              <li>
                {canCreateKeysHere ? (
                  'An api key created on this page.'
                ) : (
                  <>
                    An api key created in{' '}
                    <Link
                      from="/workspace/$userId"
                      to="account/api-keys"
                      className="underline"
                    >
                      your account api keys
                    </Link>
                    .
                  </>
                )}{' '}
                Prefer a key scoped to one workspace over a global key, as the
                assistant acts with the rights of the key.
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Claude Code</p>
            <CopyableCode
              code={buildClaudeCodeCommand(serverUrl)}
              label="Copy the Claude Code command"
            />
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">
              Other MCP clients (Claude Desktop, Cursor...)
            </p>
            <CopyableCode
              code={buildClientConfig(serverUrl)}
              label="Copy the MCP client configuration"
            />
          </div>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <InlineCode>COLANODE_URL</InlineCode> is the url of the backend
              server, not of the web app, and must not end with{' '}
              <InlineCode>/api</InlineCode>.
            </li>
            <li>
              Outside of localhost the url must use https, unless you set{' '}
              <InlineCode>COLANODE_ALLOW_HTTP=true</InlineCode>.
            </li>
            <li>
              Documents can contain instructions written by other users, so
              review the actions your assistant proposes.
            </li>
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
