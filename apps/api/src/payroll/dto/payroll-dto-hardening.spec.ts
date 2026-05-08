import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentMethod, SalaryComponentType } from '@prisma/client';
import { CreateStaffContractDto } from '../../hr/dto/create-staff-contract.dto';
import { CreatePayrollRunDto } from './create-payroll-run.dto';
import { CreateSalaryStructureDto } from './create-salary-structure.dto';

async function validationProperties(dto: object) {
  const errors = await validate(dto);

  return errors.map((error) => error.property);
}

describe('M7 payroll DTO hardening', () => {
  it('rejects invalid staff contract dates and negative salary values', async () => {
    const dto = plainToInstance(CreateStaffContractDto, {
      staffId: 'staff-1',
      contractNumber: 'CNT-001',
      position: 'Teacher',
      startDate: 'not-a-date',
      endDate: 'also-not-a-date',
      baseSalary: -1,
      allowances: -5,
      deductions: -2,
    });

    await expect(validationProperties(dto)).resolves.toEqual(
      expect.arrayContaining([
        'startDate',
        'endDate',
        'baseSalary',
        'allowances',
        'deductions',
      ]),
    );
  });

  it('accepts valid staff contract date and non-negative money values', async () => {
    const dto = plainToInstance(CreateStaffContractDto, {
      staffId: 'staff-1',
      contractNumber: 'CNT-001',
      position: 'Teacher',
      startDate: '2026-05-01',
      endDate: '2027-04-30',
      baseSalary: 45000,
      allowances: 5000,
      deductions: 1000,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects negative salary structure money and component amounts', async () => {
    const dto = plainToInstance(CreateSalaryStructureDto, {
      staffId: 'staff-1',
      effectiveFrom: '2026-05-01',
      effectiveTo: '2027-04-30',
      basicSalary: -1,
      allowances: -10,
      deductions: -5,
      paymentMethod: PaymentMethod.BANK,
      components: [
        {
          name: 'Transport Allowance',
          componentType: SalaryComponentType.EARNING,
          amount: -1,
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['basicSalary', 'allowances', 'deductions']),
    );
    expect(
      errors
        .find((error) => error.property === 'components')
        ?.children?.[0]?.children?.map((error) => error.property),
    ).toEqual(expect.arrayContaining(['amount']));
  });

  it('rejects zero working days for payroll generation', async () => {
    const dto = plainToInstance(CreatePayrollRunDto, {
      periodMonth: 5,
      periodYear: 2026,
      workingDays: 0,
    });

    await expect(validationProperties(dto)).resolves.toContain('workingDays');
  });
});
