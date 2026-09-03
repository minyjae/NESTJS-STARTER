import { Injectable } from '@nestjs/common';

export interface DatabaseImage {
  imagePath: string;
  title: string;
  description: string;
}

@Injectable()
export class DatabaseImgService {
  findAll(): DatabaseImage[] {
    return [
      {
        imagePath: '/thumb-react.svg',
        title: 'Learning React in 2026',
        description: 'Lorem',
      },
    ];
  }
}
