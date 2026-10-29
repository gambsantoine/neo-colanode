import {
  DiagramSnippetGroup,
  DiagramTemplate,
} from '@colanode/ui/lib/diagram-snippets';

export const mermaidSnippetGroups: DiagramSnippetGroup[] = [
  {
    id: 'flowchart',
    label: 'Flowchart',
    snippets: [
      { id: 'node', label: 'Node', code: 'A[$0]' },
      { id: 'round', label: 'Rounded node', code: 'A($0)' },
      { id: 'decision', label: 'Decision', code: 'A{$0}' },
      { id: 'database', label: 'Database', code: 'A[($0)]' },
      { id: 'link', label: 'Link', code: 'A --> B$0' },
      { id: 'labelled', label: 'Labelled link', code: 'A -->|$0| B' },
      { id: 'dotted', label: 'Dotted link', code: 'A -.-> B$0' },
      {
        id: 'subgraph',
        label: 'Subgraph',
        code: 'subgraph $0\n    A --> B\nend',
      },
    ],
  },
  {
    id: 'sequence',
    label: 'Sequence',
    snippets: [
      { id: 'participant', label: 'Participant', code: 'participant $0' },
      { id: 'actor', label: 'Actor', code: 'actor $0' },
      { id: 'message', label: 'Message', code: 'A->>B: $0' },
      { id: 'reply', label: 'Reply', code: 'B-->>A: $0' },
      {
        id: 'note',
        label: 'Note',
        code: 'Note right of A: $0',
      },
      {
        id: 'alt',
        label: 'Alt / else',
        code: 'alt $0\n    A->>B: Yes\nelse\n    A->>C: No\nend',
      },
      { id: 'loop', label: 'Loop', code: 'loop $0\n    A->>B: Ping\nend' },
    ],
  },
  {
    id: 'class',
    label: 'Class',
    snippets: [
      {
        id: 'class',
        label: 'Class',
        code: 'class $0 {\n    +String name\n    +run()\n}',
      },
      { id: 'inheritance', label: 'Inheritance', code: 'Parent <|-- $0' },
      { id: 'composition', label: 'Composition', code: 'Whole *-- $0' },
      { id: 'association', label: 'Association', code: 'A --> $0' },
    ],
  },
  {
    id: 'other',
    label: 'Other',
    snippets: [
      { id: 'comment', label: 'Comment', code: '%% $0' },
      { id: 'title', label: 'Title', code: '---\ntitle: $0\n---' },
      { id: 'state', label: 'State transition', code: 'StateA --> $0' },
    ],
  },
];

export const mermaidTemplates: DiagramTemplate[] = [
  {
    id: 'flowchart',
    label: 'Flowchart',
    code: `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
`,
  },
  {
    id: 'sequence',
    label: 'Sequence diagram',
    code: `sequenceDiagram
    actor User
    participant App
    participant DB
    User->>App: Request
    App->>DB: Query
    DB-->>App: Result
    App-->>User: Response
`,
  },
  {
    id: 'class',
    label: 'Class diagram',
    code: `classDiagram
    class Animal {
        +String name
        +eat()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog
`,
  },
  {
    id: 'state',
    label: 'State diagram',
    code: `stateDiagram-v2
    [*] --> Draft
    Draft --> Review
    Review --> Published
    Review --> Draft
    Published --> [*]
`,
  },
  {
    id: 'er',
    label: 'Entity relationship',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
`,
  },
  {
    id: 'gantt',
    label: 'Gantt chart',
    code: `gantt
    title Project plan
    dateFormat YYYY-MM-DD
    section Design
    Specs        :a1, 2026-01-05, 7d
    Mockups      :after a1, 5d
    section Build
    Development  :2026-01-19, 14d
`,
  },
  {
    id: 'pie',
    label: 'Pie chart',
    code: `pie title Time spent
    "Coding" : 50
    "Meetings" : 30
    "Coffee" : 20
`,
  },
  {
    id: 'mindmap',
    label: 'Mind map',
    code: `mindmap
  root((Project))
    Goals
      Users
      Revenue
    Team
      Design
      Development
`,
  },
];
