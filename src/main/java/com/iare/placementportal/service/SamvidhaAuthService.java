package com.iare.placementportal.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Service
public class SamvidhaAuthService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SamvidhaAuthService.class);

    private final ObjectMapper objectMapper;
    private final URI loginUri;
    private final URI samvidhaHomeUri;

    public SamvidhaAuthService(
            ObjectMapper objectMapper,
            @Value("${samvidha.auth.login-url:https://samvidha.iare.ac.in/pages/login/checkUser.php}") String loginUrl) {
        this.objectMapper = objectMapper;
        this.loginUri = URI.create(loginUrl);
        this.samvidhaHomeUri = URI.create(loginUri.getScheme() + "://" + loginUri.getAuthority() + "/");
    }

    public AuthenticationResult authenticate(String username, String password) {
        CookieManager cookieManager = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
        HttpClient httpClient = HttpClient.newBuilder()
                .cookieHandler(cookieManager)
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        try {
            // The official login POST is made from a loaded Samvidha page. Loading it first
            // preserves the same PHP cookie/session context for the credential check.
            HttpRequest sessionRequest = HttpRequest.newBuilder(samvidhaHomeUri)
                    .timeout(Duration.ofSeconds(15))
                    .GET()
                    .build();
            httpClient.send(sessionRequest, HttpResponse.BodyHandlers.discarding());

            String requestBody = "username=" + encode(username) + "&password=" + encode(password);
            HttpRequest loginRequest = HttpRequest.newBuilder(loginUri)
                    .timeout(Duration.ofSeconds(15))
                    .header("Accept", "application/json, text/javascript, */*; q=0.01")
                    .header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                    .header("Origin", samvidhaHomeUri.toString().replaceAll("/$", ""))
                    .header("Referer", samvidhaHomeUri.toString())
                    .header("X-Requested-With", "XMLHttpRequest")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(loginRequest, HttpResponse.BodyHandlers.ofString());
            LOGGER.debug("Samvidha login response: httpStatus={}, body={}",
                    response.statusCode(), response.body());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return AuthenticationResult.UNAVAILABLE;
            }

            JsonNode status = objectMapper.readTree(response.body()).path("status");
            // Samvidha's current official JavaScript treats status 1 as success.
            return status.asInt(Integer.MIN_VALUE) == 1
                    ? AuthenticationResult.SUCCESS
                    : AuthenticationResult.INVALID_CREDENTIALS;
        } catch (Exception exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            LOGGER.warn("Samvidha authentication is currently unavailable: {}", exception.getMessage());
            return AuthenticationResult.UNAVAILABLE;
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public enum AuthenticationResult {
        SUCCESS,
        INVALID_CREDENTIALS,
        UNAVAILABLE
    }
}
