import { IsMongoId } from 'class-validator';

export class AssignRoleDto {
  @IsMongoId({ message: 'roleId must be a valid ObjectId' })
  roleId!: string;
}
