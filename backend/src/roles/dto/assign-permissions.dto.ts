import { ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true, message: 'each permission must be valid ObjectId' })
  permissionIds!: string[];
}
