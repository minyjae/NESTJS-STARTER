import { BaseEntity } from '@/shared/entities/base.entity';

export class PostEntity extends BaseEntity {
  title: string;
  content: string | null;
  published: boolean;
}
