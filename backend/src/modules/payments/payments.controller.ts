import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @RequirePermission('payments', 'write')
  @Post('payments')
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(dto);
  }

  @RequirePermission('payments', 'read')
  @Get('payments/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.paymentsService.findById(id);
  }
}
