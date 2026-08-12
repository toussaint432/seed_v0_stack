package sn.isra.seed.catalog_service.api.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import sn.isra.seed.catalog_service.api.dto.VarieteDto;
import sn.isra.seed.catalog_service.entity.Variete;

import java.util.List;

@Mapper(componentModel = "spring")
public interface VarieteMapper {

    @Mapping(target = "especeId",       source = "espece.id")
    @Mapping(target = "especeCode",     source = "espece.codeEspece")
    @Mapping(target = "especeNomCommun", source = "espece.nomCommun")
    VarieteDto toDto(Variete entity);

    List<VarieteDto> toDtoList(List<Variete> entities);
}
