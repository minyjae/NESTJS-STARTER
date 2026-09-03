import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PostRepository } from '@/domain/posts/infrastructure/post.repository';
import { POST_REPOSITORY } from '@/domain/posts/infrastructure/post.repository-token';
import { PostsService } from './posts.service';

const now = new Date('2026-01-01T00:00:00.000Z');
const post = {
  id: '8ed17958-861a-4866-90fd-ac6df7163745',
  title: 'Example post',
  content: 'This post demonstrates a complete CRUD domain.',
  published: false,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

describe('PostsService', () => {
  let service: PostsService;
  let repository: jest.Mocked<PostRepository>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: POST_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = moduleRef.get(PostsService);
  });

  it('creates a post', async () => {
    repository.create.mockResolvedValue(post);

    await expect(
      service.create({
        title: 'Example post',
        content: 'This post demonstrates a complete CRUD domain.',
      }),
    ).resolves.toMatchObject({
      id: post.id,
      title: post.title,
      published: post.published,
    });
  });

  it('finds posts with pagination', async () => {
    repository.findMany.mockResolvedValue({
      items: [post],
      meta: { total: 1, page: 1, perPage: 10, lastPage: 1 },
    });

    await expect(
      service.findMany({ page: 1, perPage: 10, orderDirection: 'desc' }),
    ).resolves.toMatchObject({
      items: [{ id: post.id, title: post.title }],
      meta: { total: 1 },
    });
  });

  it('updates a post', async () => {
    repository.findById.mockResolvedValue(post);
    repository.update.mockResolvedValue({ ...post, title: 'Updated post' });

    await expect(service.update(post.id, { title: 'Updated post' })).resolves.toMatchObject({
      id: post.id,
      title: 'Updated post',
    });
  });

  it('deletes a post', async () => {
    repository.findById.mockResolvedValue(post);

    await service.delete(post.id);

    expect(repository.softDelete.mock.calls[0]).toEqual([post.id]);
  });

  it('throws when a post cannot be found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findById(post.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
