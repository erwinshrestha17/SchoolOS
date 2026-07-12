import { ApiProperty } from '@nestjs/swagger';

export class GeneratedStudentDocumentArtifactResponseDto {
  @ApiProperty({ description: 'Protected File Registry asset identifier' })
  fileAssetId!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: true })
  fileAvailable!: true;
}
