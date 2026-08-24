package sn.isra.seed.lot_service.api.dto;

public record LotGenStatsDto(
    String codeGeneration,
    long   nbLots,
    double totalKg
) {}
