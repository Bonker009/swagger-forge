package com.swaggerforge;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the SwaggerForge UI. Redirects /swagger-forge to /swagger-forge/index.html
 * so the static bundle (index.html + js + css) is used.
 * <p>
 * Ensure you have run <code>npm run build:embed</code> in the custom-swagger project
 * and copied <code>dist/embed/*</code> to <code>src/main/resources/static/swagger-forge/</code>.
 */
@Controller
public class SwaggerForgeController {

    @GetMapping("/swagger-forge")
    public String index() {
        return "redirect:/swagger-forge/index.html";
    }
}
