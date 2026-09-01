import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from '@/shared/interfaces/request.interface';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data && user ? user[data as keyof typeof user] : user;
  },
);
