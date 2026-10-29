import {
  DiagramSnippetGroup,
  DiagramTemplate,
} from '@colanode/ui/lib/diagram-snippets';

export const plantUmlSnippetGroups: DiagramSnippetGroup[] = [
  {
    id: 'sequence',
    label: 'Sequence',
    snippets: [
      { id: 'participant', label: 'Participant', code: 'participant $0' },
      { id: 'actor', label: 'Actor', code: 'actor $0' },
      { id: 'database', label: 'Database', code: 'database $0' },
      { id: 'message', label: 'Message', code: 'A -> B: $0' },
      { id: 'reply', label: 'Reply', code: 'B --> A: $0' },
      { id: 'self', label: 'Self message', code: 'A -> A: $0' },
      {
        id: 'activate',
        label: 'Activation',
        code: 'activate $0\n\ndeactivate',
      },
      {
        id: 'alt',
        label: 'Alt / else',
        code: 'alt $0\n  A -> B\nelse\n  A -> C\nend',
      },
      { id: 'loop', label: 'Loop', code: 'loop $0\n  A -> B\nend' },
      { id: 'group', label: 'Group', code: 'group $0\n  A -> B\nend' },
      { id: 'divider', label: 'Divider', code: '== $0 ==' },
    ],
  },
  {
    id: 'class',
    label: 'Class',
    snippets: [
      {
        id: 'class',
        label: 'Class',
        code: 'class $0 {\n  +field: Type\n  +method(): Type\n}',
      },
      {
        id: 'interface',
        label: 'Interface',
        code: 'interface $0 {\n  +method(): Type\n}',
      },
      { id: 'enum', label: 'Enum', code: 'enum $0 {\n  VALUE_A\n  VALUE_B\n}' },
      { id: 'extends', label: 'Inheritance', code: 'Parent <|-- $0' },
      { id: 'implements', label: 'Implementation', code: 'Interface <|.. $0' },
      { id: 'composition', label: 'Composition', code: 'Whole *-- $0' },
      { id: 'aggregation', label: 'Aggregation', code: 'Whole o-- $0' },
      { id: 'association', label: 'Association', code: 'A --> "1..*" $0' },
      { id: 'package', label: 'Package', code: 'package $0 {\n\n}' },
    ],
  },
  {
    id: 'activity',
    label: 'Activity',
    snippets: [
      { id: 'start', label: 'Start', code: 'start\n$0' },
      { id: 'stop', label: 'Stop', code: 'stop' },
      { id: 'action', label: 'Action', code: ':$0;' },
      {
        id: 'if',
        label: 'If / else',
        code: 'if ($0) then (yes)\n  :action;\nelse (no)\n  :other action;\nendif',
      },
      {
        id: 'while',
        label: 'While',
        code: 'while ($0)\n  :action;\nendwhile',
      },
      {
        id: 'fork',
        label: 'Fork',
        code: 'fork\n  :$0;\nfork again\n  :action;\nend fork',
      },
      { id: 'swimlane', label: 'Swimlane', code: '|$0|' },
    ],
  },
  {
    id: 'common',
    label: 'Common',
    snippets: [
      {
        id: 'note-right',
        label: 'Note (right)',
        code: 'note right\n  $0\nend note',
      },
      {
        id: 'note-left',
        label: 'Note (left)',
        code: 'note left\n  $0\nend note',
      },
      { id: 'title', label: 'Title', code: 'title $0' },
      { id: 'comment', label: 'Comment', code: "' $0" },
      { id: 'skinparam', label: 'Skin param', code: 'skinparam $0' },
      { id: 'theme', label: 'Theme', code: '!theme $0' },
      { id: 'legend', label: 'Legend', code: 'legend right\n  $0\nendlegend' },
    ],
  },
];

export const plantUmlTemplates: DiagramTemplate[] = [
  {
    id: 'sequence',
    label: 'Sequence diagram',
    code: `@startuml
actor User
participant App
database DB

User -> App: Request
App -> DB: Query
DB --> App: Result
App --> User: Response
@enduml
`,
  },
  {
    id: 'class',
    label: 'Class diagram',
    code: `@startuml
class Animal {
  +name: String
  +speak(): void
}

class Dog
class Cat

Animal <|-- Dog
Animal <|-- Cat
@enduml
`,
  },
  {
    id: 'activity',
    label: 'Activity diagram',
    code: `@startuml
start
:Receive order;
if (In stock?) then (yes)
  :Ship order;
else (no)
  :Notify customer;
endif
stop
@enduml
`,
  },
  {
    id: 'usecase',
    label: 'Use case diagram',
    code: `@startuml
left to right direction
actor Customer
rectangle Shop {
  Customer -- (Browse products)
  Customer -- (Place order)
}
@enduml
`,
  },
  {
    id: 'state',
    label: 'State diagram',
    code: `@startuml
[*] --> Draft
Draft --> Review: submit
Review --> Published: approve
Review --> Draft: reject
Published --> [*]
@enduml
`,
  },
  {
    id: 'component',
    label: 'Component diagram',
    code: `@startuml
package "Frontend" {
  [Web app]
}
package "Backend" {
  [API]
  database "Postgres"
}
[Web app] --> [API]
[API] --> [Postgres]
@enduml
`,
  },
  {
    id: 'mindmap',
    label: 'Mind map',
    code: `@startmindmap
* Project
** Goals
*** Goal A
*** Goal B
** Risks
@endmindmap
`,
  },
  {
    id: 'gantt',
    label: 'Gantt chart',
    code: `@startgantt
[Design] lasts 5 days
[Build] lasts 10 days
[Build] starts at [Design]'s end
[Test] lasts 4 days
[Test] starts at [Build]'s end
@endgantt
`,
  },
];
