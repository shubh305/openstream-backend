import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
  NotificationSeverity,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  /**
   * Get user notifications
   */
  async getNotifications(userId: string, limit: number = 20) {
    const notifications = await this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    const unreadCount = await this.notificationModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        read: false,
      })
      .exec();

    return {
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        description: n.description,
        timestamp: this.formatRelativeTime(n.createdAt),
        read: n.read,
        severity: n.severity,
      })),
      unreadCount,
    };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        read: false,
      })
      .exec();
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
        },
        { read: true },
      )
      .exec();
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany(
        { userId: new Types.ObjectId(userId), read: false },
        { read: true },
      )
      .exec();
  }

  /**
   * Clear all notifications
   */
  async clearAll(userId: string): Promise<void> {
    await this.notificationModel
      .deleteMany({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  /**
   * Create a notification
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    description: string,
    severity: NotificationSeverity = NotificationSeverity.INFO,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    await this.notificationModel.create({
      userId: new Types.ObjectId(userId),
      type,
      title,
      description,
      severity,
      metadata,
      read: false,
    });
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  }
}
