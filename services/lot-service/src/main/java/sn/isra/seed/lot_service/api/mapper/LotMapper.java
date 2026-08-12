package sn.isra.seed.lot_service.api.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import sn.isra.seed.lot_service.api.dto.LotSemencierDto;
import sn.isra.seed.lot_service.entity.LotSemencier;

import java.util.List;

@Mapper(componentModel = "spring")
public interface LotMapper {

    @Mapping(target = "generationId",    source = "generation.id")
    @Mapping(target = "generationCode",  source = "generation.codeGeneration")
    @Mapping(target = "generationOrdre", source = "generation.ordreGeneration")
    @Mapping(target = "lotParentId",     source = "lotParent.id")
    @Mapping(target = "lotParentCode",   source = "lotParent.codeLot")
    LotSemencierDto toDto(LotSemencier entity);

    List<LotSemencierDto> toDtoList(List<LotSemencier> entities);
}
