import { CategoryAttributes, categoryModel } from './category';
import { ChannelAttributes, channelModel } from './channel';
import { ChatAttributes, chatModel } from './chat';
import { DatabaseAttributes, databaseModel } from './database';
import { DatabaseViewAttributes, databaseViewModel } from './database-view';
import { FileAttributes, fileModel } from './file';
import { FolderAttributes, folderModel } from './folder';
import { MessageAttributes, messageModel } from './message';
import { PageAttributes, pageModel } from './page';
import { PresentationAttributes, presentationModel } from './presentation';
import { RecordAttributes, recordModel } from './record';
import { SpaceAttributes, spaceModel } from './space';

type NodeBase = {
  id: string;
  rootId: string;
  parentId: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type CategoryNode = NodeBase & CategoryAttributes;

export type ChannelNode = NodeBase & ChannelAttributes;

export type ChatNode = NodeBase & ChatAttributes;

export type DatabaseNode = NodeBase & DatabaseAttributes;

export type DatabaseViewNode = NodeBase & DatabaseViewAttributes;

export type FolderNode = NodeBase & FolderAttributes;

export type PageNode = NodeBase & PageAttributes;

export type PresentationNode = NodeBase & PresentationAttributes;

export type RecordNode = NodeBase & RecordAttributes;

export type SpaceNode = NodeBase & SpaceAttributes;

export type MessageNode = NodeBase & MessageAttributes;

export type FileNode = NodeBase & FileAttributes;

export type NodeType = NodeAttributes['type'];

export type NodeAttributes =
  | SpaceAttributes
  | CategoryAttributes
  | DatabaseAttributes
  | ChannelAttributes
  | ChatAttributes
  | FolderAttributes
  | PageAttributes
  | PresentationAttributes
  | RecordAttributes
  | MessageAttributes
  | FileAttributes
  | DatabaseViewAttributes;

export type Node =
  | SpaceNode
  | CategoryNode
  | DatabaseNode
  | DatabaseViewNode
  | ChannelNode
  | ChatNode
  | FolderNode
  | PageNode
  | PresentationNode
  | RecordNode
  | MessageNode
  | FileNode;

export const getNodeModel = (type: NodeType) => {
  switch (type) {
    case 'category':
      return categoryModel;
    case 'channel':
      return channelModel;
    case 'chat':
      return chatModel;
    case 'database':
      return databaseModel;
    case 'database_view':
      return databaseViewModel;
    case 'folder':
      return folderModel;
    case 'page':
      return pageModel;
    case 'presentation':
      return presentationModel;
    case 'record':
      return recordModel;
    case 'space':
      return spaceModel;
    case 'message':
      return messageModel;
    case 'file':
      return fileModel;
  }
};
