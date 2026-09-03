import { Expose } from 'class-transformer';

export class PostResponseDto {
  @Expose()
  id: string;

  @Expose()
  title: string;

  @Expose()
  content: string | null;

  @Expose()
  published: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
