import { Controller, Get, Query } from '@nestjs/common';
import { Order } from '../orders/order.entity';
import { ResumesService } from './resumes.service';

@Controller('resumes')
export class ResumesController {

  constructor(private resumesService: ResumesService) {
  }

  @Get()
  getAll(@Query() {query, pageIndex, pageSize}): Promise<any> {
    console.log('Вызвал апиху');
    return this.resumesService.getResumes({words: query, pageIndex, pageSize});
  }

  @Get('vacancies')
  getAllVacancies(@Query() {query, pageIndex, pageSize}): Promise<any> {
    console.log('Вызвал апиху');
    return this.resumesService.getVacancies({words: query, pageIndex, pageSize});
  }
}
