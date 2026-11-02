package com.toonstudio.app;

import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        TextView textView = new TextView(this);
        textView.setText("Zaitoon Studio");
        textView.setTextSize(24);
        textView.setPadding(32, 32, 32, 32);
        setContentView(textView);
    }
}
