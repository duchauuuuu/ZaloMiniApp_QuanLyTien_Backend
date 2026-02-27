import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { TransactionType } from '../../common/enums/transaction-type.enum';
import { StatisticsQueryDto } from './dto/statistics-query.dto';
import { StatisticsService } from './statistics.service';

@UseGuards(JwtAuthGuard)
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  // GET /api/statistics/by-category?month=2&year=2026&type=EXPENSE
  // → Dữ liệu cho biểu đồ tròn
  @Get('by-category')
  getByCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();
    const type = query.type ?? TransactionType.EXPENSE;

    return this.statisticsService.getByCategory(user.id, month, year, type);
  }

  // GET /api/statistics/by-month?year=2026
  // → Dữ liệu cho biểu đồ cột 12 tháng
  @Get('by-month')
  getByMonth(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    const year = query.year ?? new Date().getFullYear();
    return this.statisticsService.getByMonth(user.id, year);
  }

  // GET /api/statistics/all-time — Thống kê tổng hợp (dùng cho trang hồ sơ)
  @Get('all-time')
  getAllTimeStats(@CurrentUser() user: AuthenticatedUser) {
    return this.statisticsService.getAllTimeStats(user.id);
  }

  // GET /api/statistics/compare?month=2&year=2026
  // → So sánh tháng này vs tháng trước
  @Get('compare')
  compareMonths(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatisticsQueryDto,
  ) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();

    return this.statisticsService.compareMonths(user.id, month, year);
  }
}
