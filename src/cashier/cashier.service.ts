import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cashier } from './cashier.entity';

@Injectable()
export class CashierService {
  constructor(
    @InjectRepository(Cashier)
    private readonly cashierRepository: Repository<Cashier>,
  ) {}

  
}
