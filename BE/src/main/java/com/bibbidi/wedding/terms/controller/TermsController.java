package com.bibbidi.wedding.terms.controller;

import com.bibbidi.wedding.terms.controller.dto.TermsResponse;
import com.bibbidi.wedding.terms.service.TermsService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 약관 문구를 내려 준다. 가입하기 전에도 봐야 하므로 로그인 없이 부를 수 있다. */
@RestController
public class TermsController {

    private final TermsService termsService;

    public TermsController(TermsService termsService) {
        this.termsService = termsService;
    }

    @GetMapping("/api/terms")
    public List<TermsResponse> findAll() {
        return termsService.findAll().stream().map(TermsResponse::from).toList();
    }
}
