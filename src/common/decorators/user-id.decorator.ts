import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const userId = request.headers['x-user-id'];

    if (!userId) {
      throw new BadRequestException('Missing x-user-id header');
    }

    return userId;
  },
);
