package sn.isra.seed.stock_service.api.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import sn.isra.seed.stock_service.api.dto.StockDto;
import sn.isra.seed.stock_service.entity.Stock;

import java.util.List;

@Mapper(componentModel = "spring")
public interface StockMapper {

    @Mapping(target = "siteId",   source = "site.id")
    @Mapping(target = "codeSite", source = "site.codeSite")
    @Mapping(target = "nomSite",  source = "site.nomSite")
    @Mapping(target = "typeSite", source = "site.typeSite")
    @Mapping(target = "localite", source = "site.localite")
    @Mapping(target = "region",   source = "site.region")
    StockDto toDto(Stock entity);

    List<StockDto> toDtoList(List<Stock> entities);
}
